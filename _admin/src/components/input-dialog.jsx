import React from 'react';
import {
  Modal, FormGroup, FormControl, FormLabel, Button,
} from 'react-bootstrap';

export default class InputDialog extends React.PureComponent {
  constructor() {
    super();
    this.firstControl = React.createRef();
    this.state = { showing: false, items: [] };
  }

  componentDidUpdate(prev, next) {
    if ((prev.showing === false) && (next.showing === true)) {
      this.firstControl.current.focus();
    }
  }

  cancel = () => {
    this.setState((state) => (
      { showing: false, items: state.items }
    ));
  }

  ok = () => {
    const { items, callback } = this.state;

    const arr = items.map((item) => item.value);

    if (typeof callback === 'function') callback(arr);
    this.setState({ showing: false });
  }

  show = (title, items, callback) => {
    this.setState({
      showing: true, title, items, callback,
    });
  }

  handleValueChange = (item, ev) => {
    const { items } = this.state;
    const newItems = [...items];
    newItems[newItems.indexOf(item)].value = ev.target.value;
    this.setState({ items: newItems });
  }

  render() {
    const { items, showing, title } = this.state;

    for (let i = 0; i < items.length; i += 1) {
      items[i].key = i;
    }

    return (
      <div>
        <Modal show={showing} onHide={this.cancel} backdrop="static">
          <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {
            items.map((item) => (
              <FormGroup key={item.key}>
                <FormLabel>{item.message}</FormLabel>
                <FormControl type="text" ref={this.firstControl} value={item.value} onChange={(ev) => this.handleValueChange(item, ev)} />
              </FormGroup>
            ))
          }
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.ok}>OK</Button>
            <Button onClick={this.cancel}>Cancel</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}
