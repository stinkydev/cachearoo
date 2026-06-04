import React from 'react';
import {
  Table, Button,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

import VirtualPathItem from './virtual-path-item';
import ConfirmDialog from './confirm-dialog';
import InputDialog from './input-dialog';

const BUCKET = '_virtual_paths_config';

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default class VirtualPaths extends React.PureComponent {
  constructor() {
    super();
    this.inputDlg = React.createRef();
    this.confirmDlg = React.createRef();
    this.state = { paths: [] };
  }

  componentDidMount() {
    this.reloadData();
  }

  reloadData = (delay) => {
    setTimeout(async () => {
      const data = await globalThis.de.read('', { bucket: BUCKET, keysOnly: false });
      this.setState({ paths: data });
    }, delay || 0);
  }

  showEditDialog = (item) => {
    this.inputDlg.current.show('Edit virtual path', [
      { message: 'Logical path', value: item.content.virtualPath },
      { message: 'Physical path', value: item.content.physicalPath },
    ], async (values) => {
      let phys = values[1];
      if ((phys.charAt(phys.length - 1) !== '/') && (phys.charAt(phys.length - 1) !== '\\')) phys += '/';

      await globalThis.de.write(item.key, { virtualPath: values[0], physicalPath: phys },
        { bucket: BUCKET });
      this.reloadData();
    });
  }

  deleteItem = (item) => {
    this.confirmDlg.current.show(`Delete virtual path - ${item.content.virtualPath}`, 'Are you sure?', () => {
      globalThis.de.remove(item.key, { bucket: '_virtual_paths_config' })
        .then(() => {
          this.reloadData(0);
        });
    });
  }

  createPath = () => {
    const id = createId();
    this.inputDlg.current.show('Create virtual path', [
      { message: 'Logical path', value: '' },
      { message: 'Physical path', value: '' },
    ], async (values) => {
      let phys = values[1];
      if ((phys.charAt(phys.length - 1) !== '/') && (phys.charAt(phys.length - 1) !== '\\')) phys += '/';

      await globalThis.de.write(id, { virtualPath: values[0], physicalPath: phys }, { bucket: BUCKET });
      this.reloadData();
    });
  }

  render() {
    const { paths } = this.state;

    return (
      <div>
        <ConfirmDialog ref={this.confirmDlg} />
        <InputDialog ref={this.inputDlg} />
        <div className="tableMargin">
          <div className="page-header">
            <div>
              <h1>Virtual Paths</h1>
            </div>
            <Button variant="primary" size="sm" onClick={this.createPath}>
            <FontAwesomeIcon icon={faPlus} />
            {' '}
            New
            </Button>
          </div>
          <div className="tableBorder">
            <Table responsive size="sm" hover className="admin-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Physical path</th>
                </tr>
              </thead>
              <tbody>
                {
                paths.map((item) => (
                  <VirtualPathItem
                    item={item}
                    key={item.key}
                    onDelete={this.deleteItem}
                    onEdit={this.showEditDialog}
                  />
                ))
              }
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    );
  }
}
