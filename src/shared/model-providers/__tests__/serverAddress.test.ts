import { describe, expect, it } from 'vitest';
import {
  isLocalServerAddress,
  normalizeOllamaAddress,
  normalizeOpenAiCompatibleAddress,
  serverHost,
} from '../serverAddress';

describe('normalizeOllamaAddress', () => {
  it('fills in what people leave out', () => {
    expect(normalizeOllamaAddress('192.168.1.50')).toBe('http://192.168.1.50:11434');
    expect(normalizeOllamaAddress(' gpu-box:8080 ')).toBe('http://gpu-box:8080');
    expect(normalizeOllamaAddress('localhost')).toBe('http://localhost:11434');
    expect(normalizeOllamaAddress('https://ollama.home.lan')).toBe('https://ollama.home.lan:11434');
  });

  it('keeps a port that happens to be the scheme’s default', () => {
    expect(normalizeOllamaAddress('http://ollama.lan:80')).toBe('http://ollama.lan:80');
    expect(normalizeOllamaAddress('https://ollama.lan:443/')).toBe('https://ollama.lan:443');
  });

  it('gives the same address when normalizing its own answer', () => {
    for (const input of [
      'http://ollama.lan:80',
      'https://ollama.lan:443',
      'https://ollama.home.lan',
      'gpu-box:8080',
      '[::1]',
    ]) {
      const once = normalizeOllamaAddress(input);
      expect(once, input).not.toBeNull();
      expect(normalizeOllamaAddress(once!), input).toBe(once);
    }
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

describe('normalizeOpenAiCompatibleAddress', () => {
  it('fills in its own port, and drops a pasted /v1', () => {
    expect(normalizeOpenAiCompatibleAddress('localhost')).toBe('http://localhost:8080');
    expect(normalizeOpenAiCompatibleAddress('http://127.0.0.1:1234/v1')).toBe(
      'http://127.0.0.1:1234'
    );
  });
});

describe('isLocalServerAddress', () => {
  it('knows this machine from the network', () => {
    expect(isLocalServerAddress('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalServerAddress('http://localhost:11434')).toBe(true);
    expect(isLocalServerAddress('http://[::1]:11434')).toBe(true);
    expect(isLocalServerAddress('http://192.168.1.50:11434')).toBe(false);
    expect(isLocalServerAddress('http://gpu-box:11434')).toBe(false);
  });
});

describe('serverHost', () => {
  it('drops the scheme', () => {
    expect(serverHost('http://192.168.1.50:11434')).toBe('192.168.1.50:11434');
  });
});
