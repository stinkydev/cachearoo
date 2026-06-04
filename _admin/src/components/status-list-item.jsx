import React from 'react';
import PropTypes from 'prop-types';

export default class StatusListItem extends React.PureComponent {
  render() {
    const { item } = this.props;
    const {
      clientId,
      remoteAddress,
      connectedSince,
      reads,
      writes,
      events,
      bytesSent,
    } = item;

    return (
      <tr>
        <td>{clientId}</td>
        <td>{remoteAddress}</td>
        <td>{connectedSince}</td>
        <td>{reads}</td>
        <td>{writes}</td>
        <td>{events}</td>
        <td>{bytesSent}</td>
      </tr>
    );
  }
}

StatusListItem.propTypes = {
  item: PropTypes.shape({
    clientId: PropTypes.string.isRequired,
    remoteAddress: PropTypes.string.isRequired,
    connectedSince: PropTypes.string.isRequired,
    reads: PropTypes.number.isRequired,
    writes: PropTypes.number.isRequired,
    events: PropTypes.number.isRequired,
    bytesSent: PropTypes.number.isRequired,
  }).isRequired,
};
