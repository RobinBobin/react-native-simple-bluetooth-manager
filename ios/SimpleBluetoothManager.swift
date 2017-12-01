//
//  SimpleBluetoothManager.swift
//  SimpleBluetoothManager
//
//  Created by Robin Shalimov on 22/11/2017.
//  Copyright © 2017 Facebook. All rights reserved.
//

import Foundation;
import CoreBluetooth;

@objc(SimpleBluetoothManager) class SimpleBluetoothManager:
  RCTEventEmitter,
  CBCentralManagerDelegate
{
  var manager:CBCentralManager?;
  
  override init() {
    super.init();
    
    manager = CBCentralManager(delegate: self, queue: nil);
  }
  
  override func supportedEvents() -> [String]! {
    return [
      CONNECTED,
      CONNECTING,
      DISCONNECTED,
      DISCONNECTING,
      SERVICES_DISCOVERED,
      CHARACTERISTIC_READ,
      CHARACTERISTIC_WRITTEN
    ];
  }
  
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    // Nothing to do;
  }
  
  @objc func isValid(_ address: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) -> Void {
    resolver(nil);
  }

  @objc func isEnabled(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) -> Void {
    resolver(manager!.state == CBManagerState.poweredOn);
  }
  
  @objc func connectGatt(
    _ address: String,
    autoConnect: Bool,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock) -> Void
  {
    rejecter("", "can't connect yet", nil);
  }
  
  @objc func discoverServices(
    _ address: String,
    useCache: Bool,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock) -> Void
  {
    rejecter("", "can't discover yet", nil);
  }
  
  @objc func readCharacteristic(
    _ address: String,
    serviceUuid: String,
    characteristicUuid: String,
    options: [String: Any],
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't read yet", nil);
  }
  
  @objc func writeCharacteristic(
    _ address: String,
    serviceUuid: String,
    characteristicUuid: String,
    dataAndOptions: [String: Any],
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't write yet", nil);
  }
  
  @objc func closeGatt(
    _ address: String,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock)
  {
    rejecter("", "can't close yet", nil);
  }
}
