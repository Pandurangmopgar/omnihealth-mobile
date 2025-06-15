import 'react-native-get-random-values';

// EventTarget polyfill for React Native
if (typeof global !== 'undefined' && !global.EventTarget) {
  global.EventTarget = class EventTarget {
    constructor() {
      this._listeners = {};
    }

    addEventListener(type, listener, options) {
      if (!this._listeners[type]) {
        this._listeners[type] = [];
      }
      this._listeners[type].push({ listener, options });
    }

    removeEventListener(type, listener) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter(
        item => item.listener !== listener
      );
    }

    dispatchEvent(event) {
      if (!this._listeners[event.type]) return true;
      
      this._listeners[event.type].forEach(({ listener, options }) => {
        if (options && options.once) {
          this.removeEventListener(event.type, listener);
        }
        listener.call(this, event);
      });
      
      return !event.defaultPrevented;
    }
  };
}

// Event polyfill for React Native
if (typeof global !== 'undefined' && !global.Event) {
  global.Event = class Event {
    constructor(type, eventInitDict = {}) {
      this.type = type;
      this.bubbles = eventInitDict.bubbles || false;
      this.cancelable = eventInitDict.cancelable || false;
      this.defaultPrevented = false;
      this.timeStamp = Date.now();
    }

    preventDefault() {
      this.defaultPrevented = true;
    }

    stopPropagation() {
      // Implementation for stop propagation
    }

    stopImmediatePropagation() {
      // Implementation for stop immediate propagation  
    }
  };
}

// CustomEvent polyfill for React Native
if (typeof global !== 'undefined' && !global.CustomEvent) {
  global.CustomEvent = class CustomEvent extends global.Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict);
      this.detail = eventInitDict.detail || null;
    }
  };
}

// AbortController polyfill for React Native
if (typeof global !== 'undefined' && !global.AbortController) {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = new global.EventTarget();
      this.signal.aborted = false;
    }

    abort() {
      if (this.signal.aborted) return;
      this.signal.aborted = true;
      this.signal.dispatchEvent(new global.Event('abort'));
    }
  };
}

// Simple crypto.subtle polyfill for React Native
if (typeof global !== 'undefined') {
  if (!global.crypto) {
    global.crypto = {
      getRandomValues: function(array) {
        // react-native-get-random-values provides this
        const crypto = require('react-native-get-random-values');
        return crypto.default.getRandomValues(array);
      }
    };
  }
  
  if (!global.crypto.subtle) {
    global.crypto.subtle = {
      digest: function() {
        console.warn('crypto.subtle.digest is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      generateKey: function() {
        console.warn('crypto.subtle.generateKey is not implemented in React Native');
        return Promise.resolve({});
      },
      exportKey: function() {
        console.warn('crypto.subtle.exportKey is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      importKey: function() {
        console.warn('crypto.subtle.importKey is not implemented in React Native');
        return Promise.resolve({});
      },
      sign: function() {
        console.warn('crypto.subtle.sign is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      verify: function() {
        console.warn('crypto.subtle.verify is not implemented in React Native');
        return Promise.resolve(false);
      },
      encrypt: function() {
        console.warn('crypto.subtle.encrypt is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      decrypt: function() {
        console.warn('crypto.subtle.decrypt is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      deriveBits: function() {
        console.warn('crypto.subtle.deriveBits is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      deriveKey: function() {
        console.warn('crypto.subtle.deriveKey is not implemented in React Native');
        return Promise.resolve({});
      },
      wrapKey: function() {
        console.warn('crypto.subtle.wrapKey is not implemented in React Native');
        return Promise.resolve(new ArrayBuffer(0));
      },
      unwrapKey: function() {
        console.warn('crypto.subtle.unwrapKey is not implemented in React Native');
        return Promise.resolve({});
      }
    };
  }
}

// Ensure crypto is available on window for web compatibility
if (typeof window !== 'undefined' && !window.crypto) {
  window.crypto = global.crypto;
}

// TextEncoder/TextDecoder polyfills if needed
if (typeof global !== 'undefined') {
  if (!global.TextEncoder) {
    global.TextEncoder = class TextEncoder {
      encode(input = '') {
        const encoded = [];
        for (let i = 0; i < input.length; i++) {
          encoded.push(input.charCodeAt(i));
        }
        return new Uint8Array(encoded);
      }
    };
  }

  if (!global.TextDecoder) {
    global.TextDecoder = class TextDecoder {
      decode(input) {
        if (!input) return '';
        return String.fromCharCode.apply(null, Array.from(input));
      }
    };
  }
}

export default {}; 