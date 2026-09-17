// PM2 alternative to the systemd unit. Use one or the other, not both.
//
//   npm i -g pm2
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup     # survive reboots
//   pm2 logs istudio-monitoring

module.exports = {
    apps: [
        {
            name: 'istudio-monitoring',
            script: 'src/index.js',
            cwd: '/opt/istudio-monitoring',
            instances: 1,
            // Never cluster this: two schedulers would register two synthetic
            // students per tick and race each other through the exam.
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 20,
            restart_delay: 10000,
            // A leaked browser is the only realistic way this grows; recycle
            // rather than letting the box OOM.
            max_memory_restart: '1200M',
            env: { NODE_ENV: 'production' },
            error_file: '/var/log/istudio-monitoring/error.log',
            out_file: '/var/log/istudio-monitoring/out.log',
            merge_logs: true,
            time: true,
        },
    ],
};
