#import <Foundation/Foundation.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SimpleBluetoothManager, RCTEventEmitter)

RCT_EXTERN_METHOD(isValid:
  (NSString *)address
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(isEnabled:
  (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(connectGatt:
  (NSString *)address
  autoConnect: (BOOL)autoConnect
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(discoverServices:
  (NSString *)address
  useCache: (BOOL)useCache
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(readCharacteristic:
  (NSString *)address
  serviceUuid: (NSString *)serviceUuid
  characteristicUuid: (NSString *)characteristicUuid
  options: (NSDictionary *)options
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(writeCharacteristic:
  (NSString *)address
  serviceUuid: (NSString *)serviceUuid
  characteristicUuid: (NSString *)characteristicUuid
  options: (NSDictionary *)dataAndOptions
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(closeGatt:
  (NSString *)address
  resolver: (RCTPromiseResolveBlock)resolver
  rejecter: (RCTPromiseRejectBlock)rejecter)

- (NSDictionary *)constantsToExport {
  return @{
    @"events": @{
      @"connectionState": @{
        @"CONNECTED": @"CONNECTED",
        @"CONNECTING": @"CONNECTING",
        @"DISCONNECTED": @"DISCONNECTED",
        @"DISCONNECTING": @"DISCONNECTING"
      },
      @"gatt": @{
        @"SERVICES_DISCOVERED": @"SERVICES_DISCOVERED",
        @"CHARACTERISTIC_READ": @"CHARACTERISTIC_READ",
        @"CHARACTERISTIC_WRITTEN": @"CHARACTERISTIC_WRITTEN"
      }
    }
  };
}

@end
