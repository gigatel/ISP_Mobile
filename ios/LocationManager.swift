import Foundation
import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {

    static let shared = LocationManager()
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 10

        // 🔥 MUST for background
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false

        // 🔥 Improve reliability
        manager.activityType = .automotiveNavigation
    }

    func start() {
        print("🚀 LocationManager started")

        manager.requestAlwaysAuthorization()

        // 🔥 iOS background stability
        if CLLocationManager.locationServicesEnabled() {
            manager.startUpdatingLocation()
        }
    }

    func stop() {
        manager.stopUpdatingLocation()
    }

    // 🔥 Permission change handle karo
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        print("🔐 Permission status:", status.rawValue)

        if status == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }

        let lat = loc.coordinate.latitude
        let lng = loc.coordinate.longitude

        print("📍 iOS BG Location:", lat, lng)

        sendLocation(lat: lat, lng: lng)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ Location error:", error.localizedDescription)
    }

    private func sendLocation(lat: Double, lng: Double) {
        guard let url = URL(string: "http://prod.gigatel.me:7005/api/Location/PostLocation") else {
            print("❌ Invalid URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let body: [String: Any] = [
            "latitude": lat,
            "longitude": lng
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ API Error:", error.localizedDescription)
                return
            }

            print("✅ Location sent successfully")
        }.resume()
    }
}
