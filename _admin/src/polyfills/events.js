export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  addListener(eventName, listener) {
    return this.on(eventName, listener);
  }

  on(eventName, listener) {
    const listeners = this.events.get(eventName) || [];
    listeners.push(listener);
    this.events.set(eventName, listeners);
    return this;
  }

  once(eventName, listener) {
    const wrapped = (...args) => {
      this.removeListener(eventName, wrapped);
      listener(...args);
    };
    return this.on(eventName, wrapped);
  }

  removeListener(eventName, listener) {
    const listeners = this.events.get(eventName) || [];
    this.events.set(eventName, listeners.filter((item) => item !== listener));
    return this;
  }

  off(eventName, listener) {
    return this.removeListener(eventName, listener);
  }

  removeAllListeners(eventName) {
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
    return this;
  }

  emit(eventName, ...args) {
    const listeners = this.events.get(eventName) || [];
    listeners.forEach((listener) => listener(...args));
    return listeners.length > 0;
  }
}

export default { EventEmitter };
