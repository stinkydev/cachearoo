import React from 'react';
import {
  Modal, Button, FormGroup, FormControl, FormLabel, Form,
} from 'react-bootstrap';
import PropTypes from 'prop-types';

export default class ReplicationDialog extends React.PureComponent {
  constructor() {
    super();
    this.firstControl = React.createRef();
    this.state = {
      bucket: '', host: '', port: 4300, apiKey: '', secure: false, enabled: false, showing: false,
    };
  }

  componentDidUpdate(prev, next) {
    if ((prev.showing === false) && (next.showing === true)) {
      this.firstControl.current.focus();
    }
  }

  getURIFromState() {
    const { host, port, secure } = this.state;
    return `${(secure) ? 'wss' : 'ws'}://${host}:${port}`;
  }

  cancel = () => {
    this.setState({ showing: false });
    const { onClose } = this.props;
    onClose({ isOK: false });
  }

  close = () => {
    this.setState({ showing: false });
    const { onClose } = this.props;
    const { bucket, enabled, apiKey } = this.state;
    const uri = this.getURIFromState();

    onClose({
      isOK: true,
      bucket,
      apiKey,
      enabled,
      uri,
    });
  }

  open = (item) => {
    this.updateStateAndParseURI({
      showing: true,
      bucket: item.key,
      uri: item.config.replicationURI,
      apiKey: item.config.apiKey,
      enabled: !!item.config.replication,
    });
  }

  handleUpdateHost = (ev) => {
    this.setState({ host: ev.target.value });
  }

  handleUpdateApiKey = (ev) => {
    this.setState({ apiKey: ev.target.value });
  }

  handleUpdateEnable = () => {
    const { enabled } = this.state;
    this.setState({ enabled: !enabled });
  }

  handleUpdatePort = (ev) => {
    this.setState({ port: ev.target.value });
  }

  handleUpdateSecure = () => {
    const { secure } = this.state;
    this.setState({ secure: !secure });
  }

  updateStateAndParseURI(state) {
    const newState = state;

    if ((newState.uri == null) || (newState.uri === '')) {
      newState.host = '';
      newState.port = '4300';
      newState.secure = false;
      newState.apiKey = '';
    } else {
      const arr = newState.uri.split('://');
      if (arr.length <= 1) {
        newState.host = newState.uri;
        newState.port = '4300';
        newState.secure = false;
      } else {
        newState.secure = (arr[0] === 'wss');
        const [host, port] = arr[1].split(':');
        newState.host = host;
        newState.port = port || '4300';
      }
    }
    this.setState(newState);
  }

  render() {
    const {
      showing, bucket, host, apiKey, port, secure, enabled,
    } = this.state;

    return (
      <div>
        <Modal show={showing} onHide={this.cancel}>
          <Modal.Header closeButton>
            <Modal.Title>
              {`Replication settings for ${bucket}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormGroup>
              <FormLabel>Master Cachearoo Host</FormLabel>
              <FormControl
                ref={this.firstControl}
                type="text"
                value={host || ''}
                onChange={this.handleUpdateHost}
                placeholder="Replication Host"
              />
            </FormGroup>
            <FormGroup>
              <FormLabel>Master Cachearoo Port</FormLabel>
              <FormControl
                type="text"
                value={port || ''}
                onChange={this.handleUpdatePort}
                placeholder="Port"
              />
            </FormGroup>
            <FormGroup>
              <FormLabel>Remote API key</FormLabel>
              <FormControl
                type="text"
                value={apiKey || ''}
                onChange={this.handleUpdateApiKey}
                placeholder="API key"
              />
            </FormGroup>
            <Form.Group>
              <Form.Check type="checkbox" checked={!!secure} label="Secure" onChange={this.handleUpdateSecure} />
              <Form.Check type="checkbox" checked={!!enabled} label="Enabled" onChange={this.handleUpdateEnable} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.close}>OK</Button>
            <Button onClick={this.cancel}>Cancel</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

ReplicationDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
};
