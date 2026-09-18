import { loadApiEnv } from "@ecomscaling/config";
import { runConversionCroBenchmarksPlaybookEngineForAllOrganizations } from "@ecomscaling/api/conversion-cro-benchmarks-engine";

const env = loadApiEnv(process.env);
const result = await runConversionCroBenchmarksPlaybookEngineForAllOrganizations(env);
console.log(JSON.stringify(result));
