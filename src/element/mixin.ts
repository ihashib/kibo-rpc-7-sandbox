// Copies methods and getters (not the constructor) from a mixin class onto the element class.
function mixin(target: { prototype: object }, source: { prototype: object }) {
  Object.getOwnPropertyNames(source.prototype).forEach(function (name) {
    if (name !== 'constructor') Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name)!);
  });
}

export { mixin };
