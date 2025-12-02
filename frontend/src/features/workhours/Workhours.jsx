import React from 'react';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import TimerSelector from './TimerSelector';
import BreakTimer from './BreakTimer';

const Workhours = () => {
  return (
    <Box sx={{ padding: '30px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ marginBottom: '30px', textAlign: 'center', fontWeight: 'bold' }}>
        Work Hours Manager
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {/* Work Timer Card */}
        <Grid item xs={12} sm={6}>
          <Card sx={{
            boxShadow: 3,
            borderRadius: 2,
            height: '100%',
            transition: 'boxShadow 0.2s',
            '&:hover': {
              boxShadow: 5
            }
          }}>
            <CardContent>
              <TimerSelector />
            </CardContent>
          </Card>
        </Grid>

        {/* Break Timer Card */}
        <Grid item xs={12} sm={6}>
          <Card sx={{
            boxShadow: 3,
            borderRadius: 2,
            height: '100%',
            transition: 'boxShadow 0.2s',
            '&:hover': {
              boxShadow: 5
            }
          }}>
            <CardContent>
              <BreakTimer />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Workhours;
