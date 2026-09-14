import { describe, expect, it } from 'vitest';
import { isLocalOllamaAddress, normalizeOllamaAddress, ollamaHost } from '../ollamaAddress';

describe('normalizeOllamaAddress', () => {
  it('fills in what people leave out', () => {
    expect(normalizeOllamaAddress('192.168.1.50')).toBe('http://192.168.1.50:11434');
    expect(normalizeOllamaAddress(' gpu-box:8080 ')).toBe('http://gpu-box:8080');
    expect(normalizeOllamaAddress('localhost')).toBe('http://localhost:11434');
    expect(normalizeOllamaAddress('https://ollama.home.lan')).toBe('https://ollama.home.lan:11434');
  });

  it('keeps a port that happens to be the scheme’s default', () => {
    expect(normalizeOllamaAddress('http://ollama.lan:80')).toBe('http://ollama.lan');
    expect(normalizeOllamaAddress('https://ollama.lan:443/')).toBe('https://ollama.lan');
  });

  it('keeps only scheme, host, and port', () => {
    expect(normalizeOllamaAddress('http://127.0.0.1:11434/api/tags?x=1')).toBe(
      'http://127.0.0.1:11434'
    );
    expect(normalizeOllamaAddress('[::1]:11434')).toBe('http://[::1]:11434');
  });

  it('refuses what is not an Ollama address', () => {
    for (const input of [
      '',
      '   ',
      'file:///etc/passwd',
      'ftp://host',
      'http://user:secret@host:11434',
      'http://',
      'not a host',
    ]) {
      expect(normalizeOllamaAddress(input), input).toBeNull();
    }
  });
});

describe('isLocalOllamaAddress', () => {
  it('knows this machine from the network', () => {
    expect(isLocalOllamaAddress('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalOllamaAddress('http://localhost:11434')).toBe(true);
    expect(isLocalOllamaAddress('http://[::1]:11434')).toBe(true);
    expect(isLocalOllamaAddress('http://192.168.1.50:11434')).toBe(false);
    expect(isLocalOllamaAddress('http://gpu-box:11434')).toBe(false);
  });
});

describe('ollamaHost', () => {
  it('drops the scheme', () => {
    expect(ollamaHost('http://192.168.1.50:11434')).toBe('192.168.1.50:11434');
  });
});
