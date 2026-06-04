import React from 'react';
import { Modal, Button } from 'react-bootstrap';

export default class ConfirmDialog extends React.PureComponent {
  constructor() {
    super();
    this.state = { showing: false };
  }

  cancel = () => {
    this.setState({ showing: false });
  }

  ok = () => {
    const { callback } = this.state;
    if (typeof callback === 'function') callback();
    this.setState({ showing: false });
  }

  show(title, message, callback, hideCancel) {
    this.setState({
      showing: true, title, message, callback, hideCancel,
    });
  }

  render() {
    const {
      showing, title, message, hideCancel,
    } = this.state;
    const cancel = hideCancel ? '' : <Button onClick={this.cancel}>Cancel</Button>;
    return (
      <div>
        <Modal show={showing} onHide={this.cancel}>
          <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {message}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.ok}>OK</Button>
            {cancel}
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}
