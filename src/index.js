const { spawn, execSync } = require('child_process');
var fs = require('fs');
var os = require("os");
const path = require('path');
const clone = require('git-clone');

const express = require('express');

const app = express();

let procs = [];

let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// console.log(config);
// console.log(os.type());
// console.log(os.platform());

let platform = config[os.platform()];

function Refresh()
{
    console.log("Pulling latest");
    
    procs.forEach(inst=>{
        console.log("Killing " + inst.p.pid);
        inst.p.kill();
    });
    
    execSync(`rm -r ./metric-netplay-server`);
    
    clone(config.repo, './metric-netplay-server', [], function () {
        console.log("done");
        
        const filePath = `${process.cwd()}/metric-netplay-server/${platform.proc_path}/${platform.proc_name}`;
    
        console.log("setting permissons")
        execSync(`chmod +x ${filePath}`);
        console.log("done");
    
        for (let i = 1; i < platform.proc_count + 1; i++) {
    
            let proc = {};
            proc["name"]=os.hostname() + `-${i}`;
            proc["port"]=`1424${i + 1}`;
            
            const child = spawn(filePath, ['-n', proc["name"], '-p', proc["port"]]);
    
            child.stdout.on('data', data => {
                console.log(`stdout${i}:${data}`);
            });
    
            child.stderr.on('data', data => {
                console.error(`stderr${i}: ${data}`);
            });
    
            proc["pid"]=child.pid;
            proc["p"]=child;
            
            procs.push(proc);
        }
    });
}


app.get('/', (req, res) => {
    
    var resObj = {
        name:"test server",
        version: "0.1.3",
        uptime: os.uptime(),
        processes:procs
    }
    res.send(resObj);
    
  });

  
app.get('/procs', (req, res) => {
    
    res.send(procs);
  });

  app.get('/reboot', (req, res) => {
      
  execSync(`reboot`);
    });
  
  
app.get('/refresh', (req, res) => {
    
   Refresh();  
   console.log("Finished refresh")
    res.send(procs);
  });
  
  app.listen(3000, () =>{

   console.log('Example app is listening on port 3000.');
   Refresh();  

});
