# Cachearoo Ubuntu Installation

This directory contains the setup files for creating a Debian package (.deb) for Ubuntu systems.

## Installation

### From GitHub Releases

1. Download the latest `.deb` package from the [releases page](https://github.com/stinkydev/cachearoo/releases)
2. Install the package:
   ```bash
   sudo dpkg -i cachearoo_*.deb
   ```

### Manual Build

If you want to build the package yourself:

1. Build the application:
   ```bash
   npm install
   npm run build
   ```

2. Create the Debian package:
   ```bash
   npm run package-deb
   ```

3. The package will be created in `setup/deb/output/`

## Service Management

After installation, Cachearoo will be installed as a systemd service:

```bash
# Start the service
sudo systemctl start cachearoo

# Enable auto-start on boot
sudo systemctl enable cachearoo

# Check service status
sudo systemctl status cachearoo

# View logs
sudo journalctl -u cachearoo -f

# Stop the service
sudo systemctl stop cachearoo

# Restart the service
sudo systemctl restart cachearoo
```

## Configuration

- **Service runs as**: `cachearoo` user (created automatically)
- **Installation directory**: `/opt/cachearoo/`
- **Log directory**: `/var/log/cachearoo/`
- **Port**: 4300 (HTTP)
- **Admin interface**: http://localhost:4300

## Package Contents

- Embedded Node.js runtime (no external Node.js installation required)
- Complete application with all dependencies
- Systemd service configuration
- Automatic user creation and permissions setup
- Log rotation and management

## Uninstallation

```bash
sudo dpkg -r cachearoo
```

This will:
- Stop and disable the service
- Remove the application files
- Remove the `cachearoo` user
- Clean up log directories

## Security Features

The systemd service runs with enhanced security:
- Dedicated non-privileged user account
- Restricted filesystem access
- Private temporary directories
- System call filtering
- No new privileges escalation

## Troubleshooting

### Check if the service is running
```bash
sudo systemctl status cachearoo
```

### View recent logs
```bash
sudo journalctl -u cachearoo -n 50
```

### Test connectivity
```bash
curl http://localhost:4300
```

### Verify installation
```bash
dpkg -l | grep cachearoo
```