import React from 'react';
import { Nav, Navbar } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';

export default class TopMenu extends React.PureComponent {
  constructor() {
    super();
    this.state = { appName: 'Cachearoo' };
  }

  async componentDidMount() {
    try {
      const response = await fetch(window.location.href, { method: 'HEAD' });
      if (!response.ok) return;
      const appName = response.headers.get('X-Served-By');
      if (appName) {
        this.setState({ appName });
      }
    } catch {
      // ignore – keep the default app name
    }
  }

  render() {
    const { appName } = this.state;
    const { version } = this.props;
    // X-Served-By already embeds the version ("Cachearoo ver X"); only fall back
    // to the version prop when that header wasn't available.
    const title = (version && appName === 'Cachearoo') ? `${appName} ${version}` : appName;
    return (
      <Navbar bg="white" expand="md" className="top-menu">
        <Navbar.Brand as={NavLink} to="/buckets">{title}</Navbar.Brand>
        <Navbar.Toggle aria-controls="admin-navbar" />
        <Navbar.Collapse id="admin-navbar">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/buckets">Buckets</Nav.Link>
            <Nav.Link as={NavLink} to="/virtual-paths">Virtual Paths</Nav.Link>
            <Nav.Link as={NavLink} to="/status">Status</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

TopMenu.propTypes = {
  version: PropTypes.string,
};

TopMenu.defaultProps = {
  version: '',
};
