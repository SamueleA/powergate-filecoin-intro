import React, { useState } from 'react';
import './index.css';
import { createPow } from "@textile/powergate-client"
import { JobStatus } from "@textile/grpc-powergate-client/dist/ffs/rpc/rpc_pb";

import Button from 'react-bootstrap/Button';

const host = "http://0.0.0.0:6002";

const pow = createPow({ host });

const Powergate = () => {
  const [file, setFile] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const { status } = await pow.health.check();
      console.log('status..', status);
      const reader = new FileReader();

      reader.readAsArrayBuffer(file);

      reader.onload = async () => {
        const arrayBuffer = reader.result;
        const buffer = new Buffer(arrayBuffer);
        console.log(buffer);
        // setup - no need to generate everytime. Only for example
        const { token } = await pow.ffs.create();
        pow.setToken(token);
    
        // wallet management
        // get wallet addresses associated with your FFS instance
        const { addrsList } = await pow.ffs.addrs();
        console.log(addrsList);
        const balance = await pow.wallet.balance(addrsList[0].addr);
        console.log('balance', balance)

        // create new address named myNewAddress
        // this newly created address can be specified to be the one to use for file upload
        const { addr } = await pow.ffs.newAddr("myNewAddress");

        // Copied from the CLI... The default config of the js api doesn't work for some reason
        // but the default storage config of CLI works with testnet
        await pow.ffs.setDefaultStorageConfig(
          {
            "hot": {
              "enabled": true,
              "allowUnfreeze": false,
              "ipfs": {
                "addTimeout": 30
              }
            },
            "cold": {
              "enabled": true,
              "filecoin": {
                "repFactor": 1,
                "dealMinDuration": 518400,
                "excludedMiners": null,
                "trustedMiners": null,
                "countryCodes": null,
                "renew": {
                  "enabled": false,
                  "threshold": 0
                },
                "addr": addr,
                "maxPrice": 0
              }
            },
          }          
        );

        const config = await pow.ffs.defaultStorageConfig();
        console.log(config);
        // cache data in IPFS in preparation to store it using FFS
        const { cid } = await pow.ffs.stage(buffer);

        // initiates cold storage and deal making
        const { jobId } = await pow.ffs.pushStorageConfig(cid);

        const jobsCancel = pow.ffs.watchJobs((job) => {
          console.log('job', job);
          if (job.status === JobStatus.JOB_STATUS_CANCELED) {
            console.log("job canceled")
          } else if (job.status === JobStatus.JOB_STATUS_FAILED) {
            console.log("job failed")
          } else if (job.status === JobStatus.JOB_STATUS_SUCCESS) {
            console.log("job success!")
          }
        }, jobId);

        const bytes = await pow.ffs.get(cid)
        console.log('retrieved file', bytes);
      }
    } catch(e) {
      console.error(e);
    }
  };


  return (
    <>
      <h1>Upload a file to Filecoin through Powergate</h1>
        <form onSubmit={onSubmit} className="form">
          <input
            type="file"
            id="powergate-file"
            onChange={e => setFile(e.target.files[0])}
          />
          <Button
            type="submit"
          >
            Upload File
          </Button>
        </form>
    </>
  );
};

export default Powergate;
