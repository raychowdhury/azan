import Capacitor
import CoreLocation
import Foundation

@objc(ReverseGeocoderPlugin)
public class ReverseGeocoderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReverseGeocoderPlugin"
    public let jsName = "ReverseGeocoder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "reverseGeocode", returnType: CAPPluginReturnPromise)
    ]

    private let geocoder = CLGeocoder()

    @objc func reverseGeocode(_ call: CAPPluginCall) {
        guard let latitude = call.getDouble("latitude"),
              let longitude = call.getDouble("longitude") else {
            call.reject("Missing latitude or longitude")
            return
        }

        let location = CLLocation(latitude: latitude, longitude: longitude)
        geocoder.reverseGeocodeLocation(location) { placemarks, error in
            if let error = error {
                call.reject("Reverse geocoding failed", nil, error)
                return
            }

            guard let placemark = placemarks?.first else {
                call.reject("No place found for current coordinates")
                return
            }

            let city = placemark.locality ?? placemark.subLocality ?? placemark.name
            let region = placemark.administrativeArea
            let country = placemark.country
            let countryCode = placemark.isoCountryCode
            let displayName = [city, region]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")

            var response: JSObject = [:]
            if let city = city { response["city"] = city }
            if let region = region { response["region"] = region }
            if let country = country { response["country"] = country }
            if let countryCode = countryCode { response["countryCode"] = countryCode.uppercased() }
            response["displayName"] = displayName.isEmpty ? (country ?? "Current Location") : displayName

            call.resolve(response)
        }
    }
}

class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ReverseGeocoderPlugin())
    }
}
