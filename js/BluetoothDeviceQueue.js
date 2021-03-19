import { AbstractQueue } from "simple-common-utils";

export default class BluetoothDeviceQueue extends AbstractQueue {
   constructor(device) {
      super(new Map());
      
      this.__device = device;
   }
   
   get device() {
      return this.__device;
   }
   
   async _process(/*
      isCharacteristic,
      serviceUuid,
      ...
      */) {
      const args = [];
      const isCharacteristic = arguments[0];
      
      for (let i = 1; i < arguments.length; ++i) {
         args.push(arguments[i]);
      }
      
      return await this.__device[`write${isCharacteristic ? "Characteristic" : "Descriptor"}`](...args);
   }
}
