import ApplicationSession from "@robinbobin/react-native-application-session";

export default class BluetoothContextApplicationSession extends ApplicationSession {
  async _switchToActive() {
    let handlerName;
    
    for (let selectedDevice of this._context.selectedDevices) {
      handlerName = this._isSwitchRequested("background");
      
      if (handlerName) {
        break;
      }
      
      try {
        await selectedDevice.openConnection();
      } catch (error) {
        console.log(error);
      }
    }
    
    if (handlerName) {
      this[handlerName]();
    } else {
      this._completeSwitch();
    }
  }
  
  async _switchToBackground() {
    for (let selectedDevice of this._context.selectedDevices) {
      try {
        await selectedDevice.proxy.device.shutdown();
      } catch (error) {
        console.log(error);
      }
    }
    
    const handlerName = this._isSwitchRequested("active");
    
    if (handlerName) {
      this[handlerName]();
    } else {
      this._completeSwitch()
    }
  }
};
