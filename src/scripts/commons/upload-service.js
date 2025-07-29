import { isEmpty, preProcessEmptyObj } from "@/commons/util.js";
import log from "@/commons/logger.js";

/**
 * Common upload service for all platforms
 * Handles data preprocessing and upload coordination
 */
export class UploadService {
  /**
   * Process and upload platform data
   * @param {Object} rawData - Raw data from platform parsing
   * @param {Function} uploadFunction - Platform-specific upload function
   * @param {Function} markFunction - Platform-specific mark function
   * @param {Function} startUploadFunction - Platform-specific start upload function
   * @param {string} platformName - Name of the platform for logging
   */
  static async processAndUpload(rawData, uploadFunction, markFunction, startUploadFunction, platformName = "Platform") {
    try {
      const processedData = preProcessEmptyObj(rawData);
      log.debug(`${platformName} processed data:`, processedData);

      if (isEmpty(processedData)) {
        log.debug(`No data to upload for ${platformName}`);
        return false;
      }

      // Signal start of upload process
      if (startUploadFunction) {
        startUploadFunction();
      }

      return { success: true, data: processedData };
    } catch (error) {
      log.error(`Error processing ${platformName} data:`, error);
      return { success: false, error };
    }
  }

}

/**
 * Factory for creating platform-specific upload handlers
 */
export class UploadHandlerFactory {
  /**
   * Create an upload handler for a specific platform
   * @param {string} platformName - Name of the platform
   * @param {Function} parseDataFunction - Platform-specific data parsing function
   * @param {Function} uploadFunction - Platform-specific upload function
   * @param {Function} markFunction - Platform-specific mark function
   * @param {Function} startUploadFunction - Platform-specific start upload function
   */
  static create(platformName, parseDataFunction, uploadFunction, markFunction, startUploadFunction) {
    return async function () {
      try {
        const rawData = await parseDataFunction();
        const result = await UploadService.processAndUpload(rawData, uploadFunction, markFunction, startUploadFunction, platformName);

        if (result.success) {
          return result.data;
        }

        throw result.error;
      } catch (error) {
        log.error(`Error in ${platformName} upload handler:`, error);
        throw error;
      }
    };
  }
}
