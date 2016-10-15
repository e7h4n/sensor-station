const T6603 = require('t6603');
const Plantower = require('plantower');
const CronJob = require('cron').CronJob;
const request = require('request');
const bluebird = require('bluebird');
const GPIO = require('onoff').Gpio;
const sleep = require('sleep-promise');
const Am2315Driver = require('i2c-sensor-am2315');
const BMP085 = require('bmp085');

const t6603 = new T6603('/dev/ttyUSB0');
const g5s = new Plantower('PMS5003S', '/dev/ttyS0');
const g5sCtrl = bluebird.promisifyAll(new GPIO(4, 'out'));
const am2315 = bluebird.promisifyAll(new Am2315Driver());
const barometer = new BMP085();

function uploadData(data) {
    Object.keys(data).forEach(k => {
        data[k] += 0.0000001
    });

    data.timestamp = Date.now();

    request.post({
        url: 'https://m.jinyufeili.com/api/sensor/datas?token=' + process.env.SENSOR_API_TOKEN,
        json: data
    }, (err, resp, body) => {
        console.log(err, JSON.stringify(body));
    });
};

new CronJob({
    cronTime: '0 */5 * * * *',
    onTick: () => {
        t6603.read(0x03).then(val => {
            uploadData({
                CO2_HOME: val
            });
        });
    }
}).start();

new CronJob({
    cronTime: '0 */2 * * * *',
    onTick: () => {
        g5sCtrl.writeAsync(1).
            then(() => sleep(30 * 1000)).
            then(() => g5s.read()).
            then(ret => {
                uploadData({
                    PM25_HOME: ret['concentration_pm2.5_atmos'],
                    FORMALDEHYDE_HOME: ret['formaldehyde']
                });
            }).
            then(() => g5sCtrl.writeAsync(0));
    }
}).start();

new CronJob({
    cronTime: '0 */2 * * * *',
    onTick: () => {
        am2315.readAsync().then(data => {
            data = am2315.convertKelvinToCelsius(data);
            uploadData({
                TEMPERATURE_HOME: data.temperature,
                HUMIDITY_HOME: data.humidity,
            });
        });
    }
}).start();

new CronJob({
    cronTime: '0 */2 * * * *',
    runOnInit: true,
    onTick: () => {
        barometer.read(data => {
            uploadData({
                PRESSURE_HOME: data.pressure
            });
        });
    }
}).start();
