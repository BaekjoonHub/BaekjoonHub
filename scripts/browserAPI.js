window.browserAPI = {
  storage: {
    local: {
      get: (keys, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.local.get(keys, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          const promise = browser.storage.local.get(keys);
          if (callback) {
            promise.then(callback);
          }
          return promise;
        }
      },
      set: (data, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.local.set(data, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          const promise = browser.storage.local.set(data);
          if (callback) {
            promise.then(callback);
          }
          return promise;
        }
      },
      remove: (keys, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.local.remove(keys, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          const promise = browser.storage.local.remove(keys);
          if (callback) {
            promise.then(callback);
          }
          return promise;
        }
      }
    },
    sync: {
      get: (key, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.sync.get(key, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          return browser.storage.sync.get(key).then(callback);
        }
      },
      set: (obj, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.sync.set(obj, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          const promise = browser.storage.sync.set(obj);
          if (callback) {
            promise.then(callback);
          }
          return promise;
        }
      },
      remove: (keys, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.sync.remove(keys, callback);
        } else if (typeof browser !== 'undefined' && browser.storage) {
          const promise = browser.storage.sync.remove(keys);
          if (callback) {
            promise.then(callback);
          }
          return promise;
        }
      }
    }
  },
  runtime: {
    id: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : 
        (typeof browser !== 'undefined' && browser.runtime ? browser.runtime.id : ''),
    getURL: (path) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.getURL(path);
      } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.getURL(path);
      }
      return '';
    },
    getManifest: () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.getManifest();
      } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.getManifest();
      }
      return { version: '0.0.0' }; // �⺻�� ��ȯ
    },
    sendMessage: (message) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.sendMessage(message);
      } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.sendMessage(message);
      }
    },
    onMessage: {
      addListener: (listener) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          return chrome.runtime.onMessage.addListener(listener);
        } else if (typeof browser !== 'undefined' && browser.runtime) {
          return browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            const result = listener(request, sender, sendResponse);
            if (result && typeof sendResponse === 'function') {
              return true; // Firefox���� �񵿱� ������ ���� true ��ȯ
            }
            return false;
          });
        }
      }
    }
  },
  tabs: {
    getCurrent: (callback) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
        return chrome.tabs.getCurrent(callback);
      } else if (typeof browser !== 'undefined' && browser.tabs) {
        return browser.tabs.getCurrent().then(callback);
      }
    },
    create: (options, callback) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        return chrome.tabs.create(options, callback);
      } else if (typeof browser !== 'undefined' && browser.tabs) {
        const promise = browser.tabs.create(options);
        if (callback) {
          promise.then(callback);
        }
        return promise;
      }
    },
    remove: (tabId, callback) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        return chrome.tabs.remove(tabId, callback);
      } else if (typeof browser !== 'undefined' && browser.tabs) {
        const promise = browser.tabs.remove(tabId);
        if (callback) {
          promise.then(callback);
        }
        return promise;
      }
    },
    query: (queryInfo, callback) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        return chrome.tabs.query(queryInfo, callback);
      } else if (typeof browser !== 'undefined' && browser.tabs) {
        return browser.tabs.query(queryInfo).then(callback);
      }
    }
  }
};
