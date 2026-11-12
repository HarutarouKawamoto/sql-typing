import { config } from 'zod';

/*
 * 公開するページは Content Security Policy で eval・new Function を許さない（vite.config.js）。
 * Zod は速い検証のために new Function が使えるかを試し、止められると違反の知らせが出るので、はじめから使わない
 */
config({ jitless: true });
