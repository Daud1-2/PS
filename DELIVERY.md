# Grocery POS System

## Pricing
- One-time setup + installation: PKR 35,000
- Monthly support (optional): PKR 3,000 / month

## Included
- Offline POS system
- Billing and inventory management
- Barcode scanning and manual product entry
- Receipt printing
- Online admin dashboard
- Daily backup system

## Notes
- The cashier POS works fully offline.
- Internet is required only for sync and the admin dashboard.
- Support includes bug fixes and minor updates.

## Windows Delivery
- Installer output: `release/Grocery POS-Setup-1.0.0.exe`
- Writable local data: `%APPDATA%/Grocery POS/`
- Backups: `%APPDATA%/Grocery POS/backups/`
- Logs: `%APPDATA%/Grocery POS/logs/error.log`

## Final Testing Checklist
- 200+ rapid barcode scans
- Internet off: checkout still works
- Internet on: sync recovers successfully
- Printer disconnected: handled gracefully
- Abrupt shutdown during checkout: no database corruption
- Backup file is created and readable
- Packaged install/uninstall on a clean Windows machine
