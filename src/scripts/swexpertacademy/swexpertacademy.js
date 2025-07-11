// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";

// Platform-specific utilities
import { languages, uploadState } from "@/swexpertacademy/variables.js";
import { parseCode, parseData } from "@/swexpertacademy/parsing.js";
import uploadOneSolveProblemOnGit from "@/swexpertacademy/uploadfunctions.js";
import { startUpload, markUploadedCSS, getNickname, makeSubmitButton } from "@/swexpertacademy/util.js";
