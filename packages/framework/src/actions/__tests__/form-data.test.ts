import { describe, it, expect } from 'vitest';
import { formDataToObject, CSRF_FIELD } from '../form-data.js';

describe('formDataToObject', () => {
  it('converts single fields, collapses repeats into arrays, passes Files through', () => {
    const fd = new FormData();
    fd.append('title', 'hello');
    fd.append('tag', 'a');
    fd.append('tag', 'b');
    fd.append('tag', 'c');
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    fd.append('attachment', file);
    const obj = formDataToObject(fd);
    expect(obj.title).toBe('hello');
    expect(obj.tag).toEqual(['a', 'b', 'c']);
    expect(obj.attachment).toBe(file);
  });

  it(`strips the ${CSRF_FIELD} token field`, () => {
    const fd = new FormData();
    fd.append('name', 'x');
    fd.append(CSRF_FIELD, 'token-value');
    expect(formDataToObject(fd)).toEqual({ name: 'x' });
  });

  it('returns a null-prototype object', () => {
    const fd = new FormData();
    fd.append('title', 'hello');
    const obj = formDataToObject(fd);
    expect(Object.getPrototypeOf(obj)).toBeNull();
  });

  it('treats a field named `constructor` as an ordinary data key', () => {
    const fd = new FormData();
    fd.append('constructor', 'not-a-function');
    const obj = formDataToObject(fd);
    expect(obj.constructor).toBe('not-a-function');
  });

  it('collapses repeated `toString` fields into an array like any other key', () => {
    const fd = new FormData();
    fd.append('toString', 'a');
    fd.append('toString', 'b');
    const obj = formDataToObject(fd);
    expect(obj.toString).toEqual(['a', 'b']);
  });

  it('stores `__proto__` as a plain data key without rebinding the prototype', () => {
    const fd = new FormData();
    fd.append('__proto__', 'evil');
    const obj = formDataToObject(fd);
    expect(Object.getPrototypeOf(obj)).toBeNull();
    expect(Object.getOwnPropertyDescriptor(obj, '__proto__')?.value).toBe('evil');
  });
});
