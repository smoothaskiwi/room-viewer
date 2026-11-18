// Continue against already-generated docs; same default stages and timing report.
process.argv[2]='postbuild';
await import('./test-suite.mjs');
