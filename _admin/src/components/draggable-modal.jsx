import Draggable from 'react-draggable';
import React from 'react';
import ModalDialog from 'react-bootstrap/ModalDialog';

export default class DraggableModalDialog extends React.PureComponent {
  constructor(props) {
    super(props);
    this.nodeRef = React.createRef();
  }

  render() {
    return (
      <Draggable handle=".modal-title" nodeRef={this.nodeRef}>
        <ModalDialog ref={this.nodeRef} {...this.props} />
      </Draggable>
    );
  }
}
