import { Component, type ReactNode } from 'react';
import { AdminDataErrorCard } from '@/components/admin/AdminState';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message?: string; }

export default class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unexpected admin rendering error.' };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.children !== this.props.children && this.state.hasError) this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return <AdminDataErrorCard message={this.state.message} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
