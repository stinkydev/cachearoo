export function inherits(ctor, superCtor) {
  if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(ctor, superCtor);
  } else {
    ctor.__proto__ = superCtor;
  }

  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      configurable: true,
      enumerable: false,
      value: ctor,
      writable: true,
    },
  });
}

export default { inherits };
