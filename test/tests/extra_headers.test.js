import http from 'node:http';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import Crittr from '../../lib/classes/Crittr.class.js';

describe('Custom HTTP Headers', () => {
    let server;
    let serverPort;
    const receivedHeaders = [];

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            receivedHeaders.push(req.headers);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        .header-test { color: green; font-size: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header-test">Test</div>
                </body>
                </html>
            `);
        });

        await new Promise(resolve => {
            server.listen(0, '127.0.0.1', () => {
                serverPort = server.address().port;
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    test('passes extraHTTPHeaders to puppeteer requests', async () => {
        const testUrl = `http://127.0.0.1:${serverPort}/`;
        const crittr = new Crittr({
            urls: [testUrl],
            browser: {
                extraHTTPHeaders: {
                    'x-custom-test-header': 'custom-value-123',
                    authorization: 'Bearer secret-token',
                },
            },
        });

        const result = await crittr.run();
        expect(result.critical).toContain('.header-test');

        const matchingRequest = receivedHeaders.find(headers => headers['x-custom-test-header'] === 'custom-value-123');
        expect(matchingRequest).toBeDefined();
        expect(matchingRequest?.authorization).toBe('Bearer secret-token');
    });
});
