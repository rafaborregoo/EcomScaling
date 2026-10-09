/** Extracts only the answer string from the provider's partial JSON output. */
export function createCopilotAnswerStream(emit: (delta: string) => void) {
  let raw = "";
  let sent = "";

  return {
    reset() {
      raw = "";
      sent = "";
    },
    push(delta: string) {
      raw += delta;
      // The chat schema puts answer first. Do not expose other structured fields
      // (in particular proposed_writes) before validation and approval handling.
      const match = /^\s*\{\s*"answer"\s*:\s*"/.exec(raw);
      if (!match) return;
      const start = match[0].length;
      let answer = "";
      for (let i = start; i < raw.length; i++) {
        const char = raw[i]!;
        if (char === '"') break;
        if (char !== "\\") {
          answer += char;
          continue;
        }
        const escape = raw[++i];
        if (!escape) break;
        if (escape === "u") {
          const hex = raw.slice(i + 1, i + 5);
          if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) break;
          answer += String.fromCharCode(Number.parseInt(hex, 16));
          i += 4;
        } else {
          const escaped: Record<string, string> = {
            '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
          };
          if (!(escape in escaped)) break;
          answer += escaped[escape]!;
        }
      }
      if (answer.startsWith(sent) && answer.length > sent.length) {
        emit(answer.slice(sent.length));
        sent = answer;
      }
    },
  };
}
