const { spawn, execSync } = require('child_process');
var fs = require('fs');
var os = require("os");
const path = require('path');
const clone = require('git-clone');

const express = require('express');

const app = express();

app.use(function (req, res, next) {
    //res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4848');
    res.setHeader('Access-Control-Allow-Origin', 'https://appdash.virtexedge.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
  
    next();
  });

let procs = [];

let logs = {};

let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// console.log(config);
// console.log(os.type());
// console.log(os.platform());

let serverBinPath = './metric-netplay-server'

let platform = config[os.platform()];

function getTime(){
    return new Date().toISOString().
  replace(/T/, ' ').      // replace T with a space
  replace(/\..+/, '')     // delete the dot and everything after
}

function Refresh() {

    procs.forEach(inst => {
        console.log("Killing " + inst.p.pid);
        inst.p.kill();
    });

    procs=[];
    try
    {
    execSync(`rm -r ./metric-netplay-server`);
    }catch(e){
        console.log(e);
    } 
   console.log("Pulling latest");

    clone(config.repo, serverBinPath, [], function () {
        console.log("done");

        const filePath = `${process.cwd()}/${serverBinPath}/${platform.proc_path}/${platform.proc_name}`;

        console.log("setting permissons")
        execSync(`chmod +x ${filePath}`);
        console.log("done");

        for (let i = 1; i < platform.proc_count + 1; i++) {

            let proc = {};
            proc["name"] = os.hostname() + `-${i}`;
            proc["port"] = `1424${i + 1}`;

            const child = spawn(filePath, ['-n', proc["name"], '-p', proc["port"]]);
            
            // instantiate the logs for this process
            logs[proc.name]=[];

            child.stdout.on('data', data => {
                let line = `[${getTime()}]:${data}`;
                console.log(line);
                logs[proc.name].push(line);
            });

            child.stderr.on('data', data => {
                console.error(`err${i}: ${data}`);
                logs[proc.name].push(`err${i}:${data}`);
            });

            proc["pid"] = child.pid;
            proc["p"] = child;

            procs.push(proc);
        }
    });
}


app.get('/', (req, res) => {

    var procList = [];
    // load the server jsons
    procs.forEach(prc=>{
        try
        {
        let pson = JSON.parse(fs.readFileSync(`server-${prc.name}.json`, 'utf8'));
        pson["isAlive"]=(prc.p.exitCode == null && prc.p.killed == false && prc.p.signalCode == null);
        
        procList.push(pson);
        }
        catch(e){
            console.error(e);
        }
    });

    var resObj = {
        name: os.hostname(),
        version: config.version,
        uptime: os.uptime(),
        processes: procList
    }
    res.send(resObj);

});


app.get('/procs', (req, res) => {

    res.send(procs);
});

app.get('/reboot', (req, res) => {
    res.send({status:"reboot machine"});
    execSync(`systemctl start reboot.target`);
});


app.get('/refresh', (req, res) => {

    Refresh();
    console.log("Finished refresh")
    res.send({
        status:"refreshing..."
    });
});


app.get('/logs', (req, res) => {
    res.send(logs);
});

var port = 4949;
app.listen(port, () => {

    console.log(`App is listening on port ${port}.`);
    Refresh();

});
