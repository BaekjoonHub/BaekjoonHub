/**
 * Extension enable/disable check module
 * Separated for readability
 */
import { getObjectFromLocalStorage } from "./storage";
import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";

/**
 * Write enable warning message to log
 */
export function writeEnableMsgOnLog(): void {
  const errMsg = "확장이 활성화되지 않았습니다. 확장을 활성화하고 시도해주세요";
  log.warn(errMsg);
}

/**
 * Check if the extension is enabled
 * @returns Whether the extension is enabled
 */
export async function checkEnable(): Promise<boolean> {
  const enable = await getObjectFromLocalStorage<boolean>(STORAGE_KEYS.ENABLE);
  if (!enable) writeEnableMsgOnLog();
  return enable ?? false;
}
