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
});
