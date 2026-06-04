import React from 'react';
import {
  Table, Button,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';
import StatusListItem from './status-list-item';

export default class StatusList extends React.PureComponent {
  constructor() {
    super();
    this.state = { info: { webSocketConnections: { clients: [] } } };
  }

  componentDidMount() {
    this.reloadData();
  }

  reloadData(delay) {
    setTimeout(async () => {
      try {
        const response = await fetch('/_status');
        if (response.ok) {
          const data = await response.json();
          this.setState({ info: data });
        }
      } catch {
        // ignore – keep the previous status
      }
    }, delay || 0);
  }

  render() {
    const { info } = this.state;
    let idx = 0;

    const {
      timestamp,
      backend,
      httpRequestCount,
      httpRequestsPerSec,
      webSocketConnections,
    } = info;

    return (
      <div>
        <div className="tableMargin">
          <Button size="sm" onClick={() => { this.reloadData(); }}>
            <FontAwesomeIcon icon={faRedo} />
            {' '}
          </Button>
          <Table responsive size="sm" hover className="admin-table">
            <thead>
              <tr>
                <th>Server time</th>
                <th>Backend</th>
                <th>REST requests</th>
                <th>REST req/sec</th>
                <th>WS clients</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{timestamp}</td>
                <td>{backend}</td>
                <td>{httpRequestCount}</td>
                <td>{httpRequestsPerSec}</td>
                <td>{webSocketConnections.numberOfClients}</td>
              </tr>
            </tbody>
          </Table>
          <div className="tableBorder">
            <Table responsive size="sm" hover className="admin-table">
              <thead>
                <tr>
                  <th width="30">ID</th>
                  <th>Address</th>
                  <th>Connected Since</th>
                  <th>Reads</th>
                  <th>Writes</th>
                  <th>Events</th>
                  <th>Bytes sent</th>
                </tr>
              </thead>
              <tbody>
                {
                webSocketConnections.clients.map((item) => {
                  idx += 1;
                  return (
                    <StatusListItem
                      key={`item${idx}`}
                      item={item}
                      parent={this}
                    />
                  );
                })
              }
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    );
  }
}
