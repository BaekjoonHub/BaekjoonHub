// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";

// Platform-specific utilities
import { parseData } from "@/programmers/parsing.js";
import uploadOneSolveProblemOnGit from "@/programmers/uploadfunctions.js";
import { startUpload, markUploadedCSS } from "@/programmers/util.js";
import { levels, uploadState } from "@/programmers/variables.js";
