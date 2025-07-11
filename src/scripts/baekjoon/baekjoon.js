// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, preProcessEmptyObj, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";

// Platform-specific utilities
import { languages, bjLevel, RESULT_CATEGORY, RESULT_MESSAGE, uploadState, multiloader } from "@/baekjoon/variables.js";
import { findUsername, startUpload, markUploadedCSS } from "@/baekjoon/util.js";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions.js";
