-- Clean up stuck waiting_click executions older than 1 hour
UPDATE flow_executions SET status = 'completed' WHERE status = 'waiting_click';