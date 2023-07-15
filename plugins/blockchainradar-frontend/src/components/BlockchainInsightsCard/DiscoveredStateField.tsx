import React from 'react';
import { makeStyles, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { JsonViewer } from '@textea/json-viewer';
import { FetchDateField } from './FetchDateField';
import { AboutField } from '../AboutField';
import { DiscoveredStateTable } from './DiscoveredStateTable';

const useStyles = makeStyles({
  description: {
    wordBreak: 'break-word',
  },
});

/**
 * Props for {@link DiscoveredStateField}.
 *
 * @public
 */
export interface DiscoveredStateFieldProps {
  gridSizes?: Record<string, number>;
  label: string;
  description: string;
  state: Record<string, string> | string[];
  renderCallback: (key: string, value?: JSX.Element) => JSX.Element;
  asJson?: boolean;
  asTable?: boolean;
  date?: number;
}

/** @public */
export function DiscoveredStateField(props: DiscoveredStateFieldProps) {
  const {
    state,
    renderCallback,
    asJson = false,
    date,
    description,
    label,
    gridSizes,
  } = props;

  const classes = useStyles();

  let renderedState = <Alert severity="info">Nothing discovered</Alert>;

  if (Array.isArray(state) && state.length > 0) {
    renderedState = (
      <DiscoveredStateTable state={state} renderCallback={renderCallback} />
    );
  } else {
    const renderedElements = Object.entries(state).map(([k, v]) => {
      let value = <pre>{v}</pre>;

      if (asJson && v.match(/[\{\[]/))
        value = <JsonViewer value={JSON.parse(v)} />;
      return renderCallback(k, value);
    });
    if (state && Object.keys(state).length > 0)
      renderedState = <>{renderedElements}</>;
  }

  return (
    <AboutField label={label} gridSizes={gridSizes}>
      <Typography variant="body2" paragraph className={classes.description}>
        {description}
        {date && (
          <div>
            <small>
              <FetchDateField date={date} />
            </small>
          </div>
        )}
      </Typography>

      {renderedState}
    </AboutField>
  );
}
