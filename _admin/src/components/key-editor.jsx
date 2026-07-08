import React from 'react';
import {
  Modal, FormGroup, FormControl, FormLabel, Alert, Button, FormCheck,
} from 'react-bootstrap';

import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.min.css';
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';
import { Resizable } from 're-resizable';

import DraggableModalDialog from './draggable-modal';

export default class KeyEditor extends React.PureComponent {
  constructor() {
    super();
    let codeView = true;
    if (window.localStorage) {
      if (window.localStorage.getItem('code-view') === 'tree') {
        codeView = false;
      }
    }

    this.state = {
      showing: false, value: {}, codeView, jsonStatus: '', height: 400, startResize: 400,
    };
    this.editorContainer = React.createRef();
    this.editor = null;
    this.onResize = this.onResize.bind(this);
    this.onStartResize = this.onStartResize.bind(this);
    this.setCodeView = this.setCodeView.bind(this);
    this.setTreeView = this.setTreeView.bind(this);
  }

  componentDidMount() {
    this.createEditor();
  }

  componentDidUpdate(prevProps, prevState) {
    const { showing, height } = this.state;
    if (!prevState.showing && showing) {
      this.createEditor();
      this.syncEditorValue();
      this.resizeEditor();
      this.focusEditor();
    }

    if (prevState.showing && !showing) {
      // the modal unmounts its DOM on close, so the editor must be destroyed
      // and recreated on the next open
      this.destroyEditor();
    }

    if (prevState.height !== height) {
      this.resizeEditor();
    }
  }

  componentWillUnmount() {
    this.destroyEditor();
  }

  destroyEditor = () => {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  onStartResize() {
    const { height } = this.state;
    this.setState({ startResize: height });
  }

  onResize(ev, location, el, size) {
    const { startResize } = this.state;
    this.setState({ height: startResize + size.height });
    this.resizeEditor();
  }

  createEditor = () => {
    if (this.editor || !this.editorContainer.current) return;
    const { codeView, value } = this.state;

    this.editor = new JSONEditor(this.editorContainer.current, {
      ace,
      mode: codeView ? 'code' : 'tree',
      modes: ['code', 'tree'],
      onChange: this.jsonChanged,
      onError: this.jsonError,
    });
    this.editor.set(value || {});
  }

  resizeEditor = () => {
    if (this.editor && typeof this.editor.resize === 'function') {
      this.editor.resize();
    }
  }

  focusEditor = () => {
    if (this.editor && typeof this.editor.focus === 'function') {
      this.editor.focus();
    }
  }

  syncEditorValue = () => {
    const { value } = this.state;
    if (this.editor) {
      this.editor.set(value || {});
    }
  }

  jsonChanged = () => {
    try {
      this.setState({
        value: this.editor.get(),
        jsonStatus: '',
      });
    } catch (err) {
      this.jsonError(err);
    }
  }

  jsonError = (err) => {
    this.setState({ jsonStatus: err.message || `${err}` });
  }

  cancel = () => {
    const { value } = this.state;
    this.setState({ showing: false, value });
  }

  ok = () => {
    const { callback, key, value } = this.state;
    if ((value) && (typeof callback === 'function')) {
      callback(key, value);
    }
  }

  show = (title, key, value, callback) => {
    this.setState({
      showing: true, key, value, callback, height: 400,
    });
  }

  handleKeyChange = (ev) => {
    const newState = JSON.parse(JSON.stringify(this.state));
    newState.key = ev.target.value;
    this.setState(newState);
  }

  setTreeView = () => {
    this.setState({ codeView: false });
    if (this.editor) {
      this.editor.setMode('tree');
    }
    if (window.localStorage) {
      window.localStorage.setItem('code-view', 'tree');
    }
  }

  setCodeView = () => {
    this.setState({ codeView: true });
    if (this.editor) {
      this.editor.setMode('code');
    }
    if (window.localStorage) {
      window.localStorage.setItem('code-view', 'code');
    }
  }

  render() {
    const {
      showing, key, jsonStatus, height, codeView,
    } = this.state;
    const errormsg = jsonStatus !== '' ? <h4><Alert variant="danger">{jsonStatus}</Alert></h4> : '';
    return (
      <div>
        <Modal id="key-editor" animation={false} size="lg" keyboard={false} backdrop="static" show={showing} onHide={this.cancel} dialogAs={DraggableModalDialog}>
          <Resizable onResize={this.onResize} onResizeStart={this.onStartResize} className="modal-resizable" minHeight={500} minWidth={600} defaultSize={{ width: 'auto', height: 'auto' }}>
            <Modal.Header closeButton>
              <Modal.Title>{`Editing key: ${key}`}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <FormGroup>
                <FormLabel>Key</FormLabel>
                <FormControl placeholder="Enter key" type="text" value={key} onChange={this.handleKeyChange} />
              </FormGroup>
              <FormGroup>
                <FormCheck type="radio" inline checked={!!codeView} onChange={this.setCodeView} label="Code" name="editor-view" />
                <FormCheck type="radio" inline checked={!codeView} onChange={this.setTreeView} label="Tree" name="editor-view" />
              </FormGroup>
              <div id="editor-container">
                <div ref={this.editorContainer} style={{ height }} />
                {errormsg}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={this.ok} disabled={(jsonStatus !== '')}>Save</Button>
              <Button onClick={this.cancel}>Cancel</Button>
            </Modal.Footer>
          </Resizable>
        </Modal>
      </div>
    );
  }
}
