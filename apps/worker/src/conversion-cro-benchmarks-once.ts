import { loadApiEnv } from "@e-nora/config";
import { runConversionCroBenchmarksPlaybookEngineForAllOrganizations } from "@e-nora/api/conversion-cro-benchmarks-engine";

const env = loadApiEnv(process.env);
const result = await runConversionCroBenchmarksPlaybookEngineForAllOrganizations(env);
console.log(JSON.stringify(result));
