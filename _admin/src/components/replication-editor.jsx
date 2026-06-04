import React from 'react';
import {
  Badge,
} from 'react-bootstrap';
import PropTypes from 'prop-types';

export default class ReplicationEditor extends React.PureComponent {
  render() {
    const { enabled, connected, status } = this.props;

    if (enabled) {
      if (connected) {
        return <Badge bg="success">{ status || 'Connected' }</Badge>;
      }
      return <Badge bg="danger">{ status || 'Disconnected' }</Badge>;
    }
    return <Badge bg="secondary">Off</Badge>;
  }
}

ReplicationEditor.propTypes = {
  enabled: PropTypes.bool.isRequired,
  connected: PropTypes.bool.isRequired,
  status: PropTypes.string.isRequired,
};
