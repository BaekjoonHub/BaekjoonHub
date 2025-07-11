/** NOTE: goormlevel 핵심 로직입니다. */

// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";

// Platform-specific utilities
import { languages, difficultyLabels, uploadState } from "@/goormlevel/variables.js";
import { parseData } from "@/goormlevel/parsing.js";
import uploadOneSolveProblemOnGit from "@/goormlevel/uploadfunctions.js";
import { startUpload, markUploadedCSS } from "@/goormlevel/util.js";
