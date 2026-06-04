import React from 'react';
import { Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

export default class VirtualPathItem extends React.PureComponent {
  constructor() {
    super();
    this.state = { };
  }

  deletePathClicked = () => {
    const { onDelete, item } = this.props;
    onDelete(item);
  }

  showEditDialog = () => {
    const { onEdit, item } = this.props;
    onEdit(item);
  }

  render() {
    const { item } = this.props;

    return (
      <tr key={item.key}>
        <td>{item.content.virtualPath}</td>
        <td>{item.content.physicalPath}</td>
        <td>
          <Button variant="outline-secondary" size="sm" className="smaller-btn" onClick={this.showEditDialog}>Edit</Button>
&nbsp;
        </td>
        <td><Button variant="outline-danger" size="sm" className="smaller-btn" onClick={this.deletePathClicked}>Delete</Button></td>
      </tr>
    );
  }
}

VirtualPathItem.propTypes = {
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  item: PropTypes.shape({
    key: PropTypes.string.isRequired,
    content: PropTypes.shape({
      virtualPath: PropTypes.string.isRequired,
      physicalPath: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
