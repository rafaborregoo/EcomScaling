import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_VIDEO_SECONDS = 180;
const MAX_EXTRACTED_FRAMES = 8;
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

export type ExtractedVideoFrame = { timestampSeconds: number; buffer: Buffer };

/** Muestrea todo el vídeo en un máximo de ocho fotogramas uniformes. */
export async function extractMetaVideoFrames(video: Buffer): Promise<{
  durationSeconds: number;
  frames: ExtractedVideoFrame[];
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "a15-meta-video-"));
  const inputPath = path.join(directory, "source-video");
  const outputPattern = path.join(directory, "frame-%02d.jpg");
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
  try {
    await writeFile(inputPath, video, { flag: "wx", mode: 0o600 });
    const probe = await execFileAsync(ffprobe, [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath,
    ], { timeout: 15_000, maxBuffer: 64 * 1024 });
    const durationSeconds = Number(probe.stdout.trim());
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_SECONDS) {
      throw new Error("meta_video_duration_out_of_range");
    }
    const targetFrames = Math.min(MAX_EXTRACTED_FRAMES, Math.max(1, Math.ceil(durationSeconds / 3)));
    const framesPerSecond = targetFrames / durationSeconds;
    await execFileAsync(ffmpeg, [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
      "-vf", `fps=${framesPerSecond.toFixed(8)},scale=1280:1280:force_original_aspect_ratio=decrease`,
      "-frames:v", String(MAX_EXTRACTED_FRAMES), "-q:v", "4", outputPattern,
    ], { timeout: 90_000, maxBuffer: 256 * 1024 });
    const frameNames = (await readdir(directory))
      .filter((name) => /^frame-\d{2}\.jpg$/.test(name))
      .sort()
      .slice(0, MAX_EXTRACTED_FRAMES);
    const frames: ExtractedVideoFrame[] = [];
    for (const [index, name] of frameNames.entries()) {
      const frame = await readFile(path.join(directory, name));
      if (!frame.length || frame.length > MAX_FRAME_BYTES) continue;
      frames.push({ timestampSeconds: Math.min(durationSeconds, index / framesPerSecond), buffer: frame });
    }
    if (frames.length === 0) throw new Error("meta_video_no_frames_extracted");
    return { durationSeconds, frames };
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
      throw new Error("meta_video_extractor_unavailable");
    }
    throw cause;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
