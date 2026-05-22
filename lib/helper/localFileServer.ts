import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import http from 'node:http';
import path from 'node:path';
import fs from 'fs-extra';

type MimeMap = Record<string, string>;

const MIME_TYPES: MimeMap = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.eot': 'appliaction/vnd.ms-fontobject',
    '.ttf': 'aplication/font-sfnt',
};

const staticServerFunc = (rootPath: string): Server => {
    return http.createServer((req: IncomingMessage, res: ServerResponse) => {
        const parsedUrl = new URL(req.url ?? '/', 'http://localhost:8000');
        let pathname = `${rootPath}${parsedUrl.pathname}`;

        fs.access(pathname, fs.constants.F_OK, (accessErr: NodeJS.ErrnoException | null) => {
            if (accessErr) {
                res.statusCode = 404;
                res.end(`File ${pathname} not found!`);
                console.log('404 - FILE NOT FOUND', pathname);
                return;
            }

            if (fs.statSync(pathname).isDirectory()) {
                pathname += '/index.html';
            }

            fs.readFile(pathname, (readErr: NodeJS.ErrnoException | null, data: Buffer) => {
                if (readErr) {
                    res.statusCode = 500;
                    res.end(`Error getting the file: ${readErr}.`);
                    console.log('500 - ERROR GETTING FILE', pathname);
                    return;
                }

                const ext = path.parse(pathname).ext;
                res.setHeader('Content-type', MIME_TYPES[ext] ?? 'text/plain');
                res.end(data);
            });
        });
    });
};

export const createStaticServer = (rootPath: string): Server => {
    const staticServer = staticServerFunc(rootPath);
    // Do not set a short socket timeout: Puppeteer may keep connections alive while
    // waiting for navigation; a 1s idle timeout caused flaky failures in GitHub Actions.
    return staticServer;
};
