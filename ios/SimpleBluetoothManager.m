#import <Foundation/Foundation.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SimpleBluetoothManager, RCTEventEmitter)

RCT_EXTERN_METHOD(isValid:
   (NSString *)uuid
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(isEnabled:
   (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(startScan:
   (NSDictionary *)options
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(stopScan:
   (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(connectGatt:
   (NSString *)uuid
   autoConnect: (BOOL)autoConnect
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(discoverServices:
   (NSString *)uuid
   useCache: (BOOL)useCache
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(readCharacteristic:
   (NSString *)peripheralUuid
   serviceUuid: (NSString *)serviceUuid
   characteristicUuid: (NSString *)characteristicUuid
   options: (NSDictionary *)options
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(writeCharacteristic:
   (NSString *)peripheralUuid
   serviceUuid: (NSString *)serviceUuid
   characteristicUuid: (NSString *)characteristicUuid
   dataAndOptions: (NSDictionary *)dataAndOptions
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(setCharacteristicNotification:
   (NSString *)peripheralUuid
   serviceUuid: (NSString *)serviceUuid
   characteristicUuid: (NSString *)characteristicUuid
   enable: (BOOL)enable
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(writeDescriptor:
   (NSString *)peripheralUuid
   serviceUuid: (NSString *)serviceUuid
   characteristicUuid: (NSString *)characteristicUuid
   descriptorUuid: (NSString *)descriptorUuid
   dataAndOptions: (NSDictionary *)dataAndOptions
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(closeGatt:
   (NSString *)uuid
   resolver: (RCTPromiseResolveBlock)resolver
   rejecter: (RCTPromiseRejectBlock)rejecter)

@end
