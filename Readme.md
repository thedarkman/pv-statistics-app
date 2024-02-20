# PV Statistik

Small node.js application to query time series data from Victron VRM API or an InfluxDB v1.x

## dotenv

For secret configuration and user access control a .env file is needed
These keys are supported:

* `SESSION_SECRET` (*) - Random generated string at least 32 characters
* `PORT` - The port on which this web application will listen; defaults to 8080
* `CONTEXT_PATH` - When you need to run the web application in a sub-path of your domain
  like https://mydomain.com/vrm-stats/
* `VRM_ACCESS_TOKEN` - Only needed for Victron VRM Api access
* `USER_CONFIG` - Small JSON object string with username / password pairs

(*) - Mandatory

## Solar Charger config

A single JSON file will configure the solar charger to query. There are example files for "vrm" and "influx" included.

Just use one of those examples and copy / move it to "config.json"

### Victron Api

To use the Victron version of this web application you will need to create an access token in the VRM
Portal https://vrm.victronenergy.com/access-tokens

Copy that generated token to your .env file as VRM_ACCESS_TOKEN

The "instance" field in your config.json file needs to match the instance of you MPPT charger.
This id is shown on the device list. It is the "VRM Instanz" property.

![Place to find the instance id on vrm portal device list](doc/vrm_device_list_instance.png)

For the VRM portal config you will need the installation id shown in the URL and set it in the config file as "`idSite`"
Example config for VRM portal use:

```
{
  "type": "vrm",
  "title": "Mein Ort",
  "idSite": 47110815,
  "charger": [
    {
      "instance": 0,
      "name": "West",
      "mppts": 1
    },
    {
      "instance": 1,
      "name": "Süd",
      "mppts": 2
    }
  ]
}
```

With the property `mppts` you can define if a charger as multiple independent mppts. Afaik only the RS 450/x have this

### InfluxDB

Currently only connections without authentication are supported

You need to set a host, database, bucket and the property of the generated kWh of the day. Example config:

```
{
  "type": "influx",
  "title": "Mein Ort",
  "host": "192.168.0.15",
  "port": 8086,
  "charger": [
    {
      "instance": 0,
      "database": "solar",
      "bucket": "power",
      "name": "Balkonkraftwerk",
      "property": "today"
    }
  ]
}
```